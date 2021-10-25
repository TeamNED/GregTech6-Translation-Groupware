#include "Generator.hpp"

Generator::Generator(){};

Generator::~Generator() {}

string &Generator::group() { return this->_group; }
string &Generator::namespace_prefix() { return this->_namespace_prefix; }
bool &Generator::cached() { return this->_cached; }
bool &Generator::completed() { return this->_completed; }
vector<string> &Generator::extentions() { return this->_extentions; }