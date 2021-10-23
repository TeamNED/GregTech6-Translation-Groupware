#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include <boost/program_options.hpp>
#include <ryml/ryml_std.hpp>
#include <ryml/ryml.hpp>

using std::string;
using std::vector;
namespace po = boost::program_options;

string get_file_contents(const string& filename)
{
    std::ifstream in(filename, std::ios::in | std::ios::binary);
    if (!in) {
        std::cerr << "No such file: " << filename << std::endl;
        exit(1);
    }
    std::ostringstream contents;
    contents << in.rdbuf();
    return contents.str();
}

int main(int argc, char const *argv[]) 
{
    // Declare options
    po::options_description desc("Available options");
    desc.add_options()
        ("help", "show help message")
        ("workplace,w", po::value<string>(), "workplace for language files and configs")
        ("language,l", po::value<string>(), "language code")
        ("source,s", po::value<vector<string> >(), "source language files")
        ("target,t", po::value<vector<string> >(), "target language files")
        ("config,c", po::value<string>(), "config file")
    ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);    

    if (vm.count("help")) {
        std::cout << desc << "\n"; 
        return 1;
    }

    string config_path;
    if (vm.count("config")) {
        config_path = vm["config"].as<string>();
        std::cout << "config file using" << config_path << ".\n";
    } else {
        std::cout << "config not found.\n";
        return 1;
    }

    string contents = get_file_contents(config_path);
    ryml::Tree tree = ryml::parse(ryml::to_csubstr(contents));
    ryml::NodeRef root = tree.rootref();
    for (ryml::NodeRef const& child : root.children()) {
        std::cout << "key: " << child.key() << std::endl;
    }
    return 0;
}