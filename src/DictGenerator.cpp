#include "DictGenerator.hpp"

DictGenerator::DictGenerator(shared_ptr<IGeneratorMeta> meta)
    : Generator(meta) {}

DictGenerator::DictGenerator(shared_ptr<IGeneratorMeta> meta,
                             map<string, string> dict)
    : Generator(meta), _dict(dict) {}

map<string, string> &DictGenerator::dict() { return this->_dict; }